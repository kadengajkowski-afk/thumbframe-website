// src/editor/utils/apiClient.js
// Shared API client for all editor fetch calls.
// Automatically attaches the Supabase auth token — components never need to
// touch localStorage or supabase.auth.getSession() for Railway API calls.

const API_URL = (
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://thumbframe-api-production.up.railway.app'
    : 'http://localhost:5000')
).replace(/\/$/, '');

export { API_URL };

// Reads the Supabase access token from localStorage (fast, no network round-trip).
// Falls back to supabase.auth.getSession() if the localStorage key isn't found.
export async function getAuthToken() {
  try {
    const tokenKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
    if (tokenKey) {
      const stored = JSON.parse(localStorage.getItem(tokenKey));
      const token  = stored?.access_token || stored?.data?.session?.access_token || null;
      if (token) return token;
    }
  } catch { /* ignore parse errors */ }

  // Fallback: live session lookup
  try {
    const { createClient } = await import('@supabase/supabase-js');
    void createClient; // only imported to satisfy the import — use global supabase below
  } catch { /* ignore */ }
  try {
    const supabase = (await import('../../supabaseClient')).default;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

// Drop-in replacement for fetch() that:
//   • Prepends API_URL to the path
//   • Injects Authorization: Bearer <token> automatically
//   • Merges any caller-supplied headers (caller headers win)
export async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

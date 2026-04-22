import { createContext, useContext, useState, useEffect } from 'react';
import supabase from '../supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── Spinner (shown only while session is unknown, no cached user) ──────────────
function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050507',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.06)',
          borderTopColor: '#FF6B00',
          animation: 'tf-spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: '#8a8a93', fontWeight: '600', fontFamily: 'system-ui, sans-serif' }}>
          Loading…
        </div>
      </div>
      <style>{`@keyframes tf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Build a normalised user object from a Supabase session ────────────────────
function buildUser(session) {
  return {
    id:               session.user.id,
    email:            session.user.email,
    name:             session.user.user_metadata?.name || session.user.email?.split('@')[0],
    plan:             session.user.user_metadata?.is_pro ? 'pro' : 'free',
    is_pro:           session.user.user_metadata?.is_pro === true,
    is_dev:           session.user.user_metadata?.is_dev === true, // may be absent; enriched below
    stripeCustomerId: session.user.user_metadata?.stripeCustomerId || null,
    createdAt:        session.user.created_at,
  };
}

// ── Fetch is_dev + is_pro from the profiles table ─────────────────────────────
// profiles.id is a bigint, NOT the auth UUID — query by email instead.
async function fetchProfile(email) {
  if (!email) return {};
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_dev, is_pro, plan, editor_version')
      .eq('email', email)
      .single();
    if (error) {
      console.warn('[Auth] fetchProfile error:', error.message);
      return {};
    }
    return data || {};
  } catch (err) {
    console.warn('[Auth] fetchProfile threw:', err);
    return {};
  }
}

// ── Fresh token helper — always calls getSession() so Supabase auto-refreshes ─
export async function getFreshToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session.access_token;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // Instantly paint from cache so returning users never see a blank flash.
  // If the cached user is missing is_dev, drop it so bootstrap re-fetches the profile.
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('thumbframe_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Evict stale cache entries that pre-date is_dev being tracked
      if (parsed && !Object.prototype.hasOwnProperty.call(parsed, 'is_dev')) {
        localStorage.removeItem('thumbframe_user');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Reactive token — always in sync with Supabase's auto-refresh
  const [token, setToken] = useState(() => localStorage.getItem('thumbframe_token') || null);

  // Only block render if we have no cached user to show.
  const [loading, setLoading] = useState(() => !localStorage.getItem('thumbframe_user'));

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const token = session.access_token;
          localStorage.setItem('thumbframe_token', token);
          setToken(token);

          // Start with session data, then enrich from profiles table + /api/me
          let enriched = buildUser(session);

          // ── Fetch is_dev + is_pro directly from profiles table (keyed by email) ──
          const profile = await fetchProfile(session.user.email);
          enriched = {
            ...enriched,
            is_dev: profile.is_dev === true,
            is_pro: profile.is_pro === true || enriched.is_pro,
            plan:   profile.plan || enriched.plan,
            editor_version: profile.editor_version === 'v2' ? 'v2' : 'v1',
          };

          // Try to enrich further from backend /api/me (non-fatal if absent).
          try {
            const r = await fetch(`${API_URL}/api/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) {
              const u = await r.json();
              enriched = {
                ...enriched,
                plan:             u.plan || enriched.plan,
                is_pro:           u.plan === 'pro' || enriched.is_pro,
                stripeStatus:     u.stripeStatus || null,
                trialEndsAt:      u.trialEndsAt  || null,
                stripeCustomerId: u.stripeCustomerId || enriched.stripeCustomerId,
                createdAt:        u.createdAt || enriched.createdAt,
                name:             u.name || enriched.name,
              };
            }
          } catch {
            // Backend unreachable — use Supabase data, no problem.
          }

          console.log('[Auth] user loaded:', {
            id: enriched.id,
            email: enriched.email,
            is_dev: enriched.is_dev,
            is_pro: enriched.is_pro,
            plan: enriched.plan,
          });

          if (mounted) {
            setUser(enriched);
            localStorage.setItem('thumbframe_user', JSON.stringify(enriched));
          }
        } else {
          // No active session — clear any stale cache.
          localStorage.removeItem('thumbframe_token');
          localStorage.removeItem('thumbframe_user');
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error('[Auth] Bootstrap failed:', err);
        localStorage.removeItem('thumbframe_token');
        localStorage.removeItem('thumbframe_user');
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    // Stay in sync with Supabase events (token refresh, sign-out from another tab, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('thumbframe_token', session.access_token);
        setToken(session.access_token);
        return;
      }

      if (session?.user) {
        const freshToken = session.access_token;
        localStorage.setItem('thumbframe_token', freshToken);
        setToken(freshToken);
        // Fetch profile so is_dev is always present after sign-in
        ;(async () => {
          let u = buildUser(session);
          const profile = await fetchProfile(session.user.email);
          u = {
            ...u,
            is_dev: profile.is_dev === true,
            is_pro: profile.is_pro === true || u.is_pro,
            plan:   profile.plan || u.plan,
            editor_version: profile.editor_version === 'v2' ? 'v2' : 'v1',
          };
          console.log('[Auth] onAuthStateChange user:', {
            email: u.email, is_dev: u.is_dev, is_pro: u.is_pro,
          });
          if (mounted) {
            setUser(u);
            localStorage.setItem('thumbframe_user', JSON.stringify(u));
          }
        })();
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('thumbframe_token');
        localStorage.removeItem('thumbframe_user');
        setToken(null);
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('thumbframe_token');
    localStorage.removeItem('thumbframe_user');
    setToken(null);
    setUser(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthContext.Provider value={{ user, setUser, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

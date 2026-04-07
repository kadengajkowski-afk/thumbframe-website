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
    stripeCustomerId: session.user.user_metadata?.stripeCustomerId || null,
    createdAt:        session.user.created_at,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // Instantly paint from cache so returning users never see a blank flash.
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('thumbframe_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

          // Try to enrich user data from backend /api/me (non-fatal if absent).
          let enriched = buildUser(session);
          try {
            const r = await fetch(`${API_URL}/api/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) {
              const u = await r.json();
              enriched = {
                ...enriched,
                plan:             u.plan || enriched.plan,
                is_pro:           u.plan === 'pro',
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
        return;
      }

      if (session?.user) {
        const token = session.access_token;
        localStorage.setItem('thumbframe_token', token);
        const u = buildUser(session);
        setUser(u);
        localStorage.setItem('thumbframe_user', JSON.stringify(u));
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('thumbframe_token');
        localStorage.removeItem('thumbframe_user');
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
    setUser(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

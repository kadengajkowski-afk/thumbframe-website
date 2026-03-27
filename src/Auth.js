import supabase from './supabaseClient';

export async function signIn({ email, password, setLoading }) {
  setLoading(true);
  try {
    console.log('[AUTH] Attempting login with:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('[AUTH] Response received:', { hasData: !!data, hasError: !!error, hasSession: !!data?.session });
    console.log('[AUTH] Full data:', data);
    console.log('[AUTH] Full error:', error);

    // Immediate hard redirect on successful login.
    if (!error && data?.session) {
      console.log('[AUTH] ✓ Session valid - redirecting to /editor');
      console.log('[AUTH] About to call window.location.href');
      window.location.href = '/editor';
      console.log('[AUTH] window.location.href called (this may not log if redirect is immediate)');
      return { data, error, redirected: true };
    }

    console.log('[AUTH] ✗ No session or error present - returning to caller');
    return { data, error };
  } catch (error) {
    console.error('[AUTH] Exception during sign-in:', error);
    return { data: null, error };
  } finally {
    console.log('[AUTH] Finally block - setting loading to false');
    setLoading(false);
  }
}

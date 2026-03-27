import supabase from './supabaseClient';

export async function signIn({ email, password, setLoading, onSuccess }) {
  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && data?.session) {
      onSuccess();
      return { data, error: null };
    }

    return { data, error };
  } catch (err) {
    console.error('[AUTH] Sign-in error:', err);
    return { data: null, error: err };
  } finally {
    setLoading(false);
  }
}
